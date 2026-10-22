# Recent memory

The readable fallback of Engram: a `RECENT.md` per project in the private backup, rebuilt at each backup, kept clean by its selection, and read when Engram fails.
Branch: feat/recent-memory. Delivery: ask-on-risk. Tests: `node --test` through `npm run check`. Engram mirror: `odd/recent-memory/tasks`.

## Goal
When Engram is down, wiped or emptied for a project, a session is told so at its start, reads what the project is doing and what was decided from a Markdown file, and is told how to bring Engram back; and no wipe, whole or of one project, overwrites the good copy.

## Why
A PC Manager cleanup already lost Engram's memories once (odd/tasks/memory-backup.md, S1). The backup keeps a full JSON export, but nothing a session reads: restoring takes a command and his time, and the public SUMMARY.md lists decisions as titles only. His answer to Pregunta 45 (S1) asks for a living document that a session uses when the memories fail, built and kept clean by the protocol, for large projects of any kind.

## Done when
- `node --test bin/backup.test.mjs bin/lib/backup.test.mjs bin/lib/backup-recent.test.mjs bin/lib/backup-restore.test.mjs bin/lib/manifest.test.mjs bin/install.test.mjs bin/doctor.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/recent-memory.md` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs backup verify --from https://github.com/jsaristi/js-harness-memory.git` exits 0
- `node bin/js-harness.mjs backup ready` prints no `missing:` line about the readable fallback
- The probe (D8) passes: the real hook, run against an empty Engram, prints the notice, and a session with no Engram answers the written rubric from the file; the Log holds the verdict per fact, the transcript stays out of this repository.

## In scope / Out of scope
- In: `bin/lib/backup-recent.mjs` and its test; the export's guard in `bin/lib/backup.mjs` (D6); `runBackup`, `dueReason`, `verify`, `ready`, `doctor`'s backup row and the SessionStart hook in `bin/backup.mjs` and `bin/lib/manifest.mjs`; RESTORE.md; the js-harness skill; help, README, SPEC, the user guide; the roadmap lines of "Memory that survives the machine".
- Out: the public summary (SUMMARY.md stays titles only, S2). Engram itself (this only reads its export and runs `engram stats`). Writing to Engram from the file (`backup restore` does that). An all-time "foundations" tier (pinning in Engram does it: pinned entries always go in). Model-written summaries.

## Constraints
- The content never leaves the private repository and the local clone — because it names clients and private projects (S2). Outputs that may be pasted in public (`ready`, `verify`, this Log) print counts, never project names or contents.
- A file is built only from an export the run accepted, and a project that lost more than a tenth of its memories keeps its last file — because a wipe must never overwrite the good fallback (D6).
- The hook never slows or breaks a session start — one `engram stats` call, a 3-second limit, exit 0 always; silent when Engram is healthy.
- Nothing time-dependent in the files — because a backup with nothing new commits nothing (memory-backup D1).
- Zero dependencies.

## Ask me before
- Anything that puts memory content in the public repository.
- Spend beyond the probe (D8): one `claude -p` run on his plan, no API key.

## Specs
- S1 His answer to Pregunta 45, verbatim (transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 18060, 2026-10-22T04:32:36Z). The question: "Pregunta 45: Documento vivo de memoria: ¿armo un RECENT.md en el repo privado del backup con las últimas 100 memorias importantes de engram (decisiones, arquitectura, bugs, descubrimientos), cada una con fecha, qué y por qué, regenerado en cada backup?" He chose "Sí, armalo así (Recommended)" and typed: "RECENT.md en el repo privado del backup, con las últimas 100 memorias importantes y su contenido completo, regenerado en cada backup. Es una feature chica de backup, con test primero. y metelo al protocolo para que se arme y se higienice y se actualice osea hagamos un sistema para que funcione bien no importa si se ve en el repositorio que es publico y que cuando el sistema se quede sin memorias osea engram, este busque el archivo recent osea tiene que armarlo y ternrlo actualizado pero utilizarlo cuando las memorias fallan es nuestro sistema de respaldo por si se nos borran las memorias de engram, que mas piensas que podemos hacer para que esto que propongio sea mejor, recuerda que esto es un sistema de alta calidad y solidez para proyectos grandes y de todo tipo."
- S2 The lead's brief: RECENT.md in the PRIVATE backup repository, next to engram/export.json; the code and protocol in the public repository, the memory content private, "because it names clients and private projects".
- S3 The last 100 important observations (decision, architecture, bugfix, discovery, ...), each with date, what and why, and their full content (S1: "su contenido completo").
- S4 Regenerated at each `backup run`.
- S5 In the protocol: built, kept clean ("se higienice") and current, and used when Engram fails.
- S6 The lead's proposals 1-6 (selection by weight; a size budget a session reads in one go; one per project; fallback order Engram, RECENT.md, export.json with a session-start notice and a local copy; freshness in `ready` and doctor; a probe with Engram off), each settled in the Design below.

## Design

Searched first: his words on the subject (S1, through `js-harness sessions --quote`), odd/tasks/memory-backup.md and odd/tasks/backup-ready.md, and the roadmap section. Measured on the live export (2026-10-22, scope `all`): 5,219 observations in 11 projects; js-harness holds 2,449, of which 165 are of an important type (decision 74, discovery 53, bugfix 18, architecture 18, config 1, learning 1), 238 session summaries and 2,046 passive captures. The newest 100 important ones of js-harness hold 322 KiB of content (about 80k tokens), 7 of them over 4,000 characters, all feature-document mirrors (`odd/<feature>/tasks`, up to 50 KB). 112 js-harness observations carry a topic_key, none shared. 1,121 relations: 10 `supersedes` (all judged), 28 `pending`. No observation carries `deleted_at`; none of js-harness is pinned or personal. Sessions carry the `directory` they ran in. `engram import` skips an observation whose sync_id it already holds (measured on a scratch store: the second import of 4 observations reported "0 imported, 4 skipped stale"), so a restore with `--merge` over a partly filled Engram adds only what is missing.

### D1 Where the files live
In the private clone, beside `engram/export.json`: `recent/<file>.md`, one per Engram project with at least one important observation, and `RECENT.md` at the root, the index (one line per project: file, entries, newest date). The folder is mirrored: a project gone from the export loses its file, except under D6's guard. File name: the project in lower case, every character outside `[a-z0-9_-]` a `-`; a Windows reserved name (`con`, `nul`, `aux`, `prn`, `com1`…`lpt9`) gains `-project`; two projects that would share a name each gain the first 8 hex digits of their name's sha256. Which projects exist follows `config.json`'s `scope`: `all` gives every project, one name gives that one (the default, `js-harness`). The local clone is the copy that needs no network; the same files are in the private repository on GitHub.

### D2 What a file holds (S3, S6.2)
Important types: decision, architecture, bugfix, discovery, pattern, config, preference, feedback, reference, learning. Out: `passive`, `session_summary` (D3), `manual` (untyped), tool events.
Each entry: its title as a heading; one line with the day (`updated_at`), type, topic_key, `personal` when so, `pinned` when so, `contested by <sync_id>` for each pending conflict relation it is part of, and its `sync_id`; then the content in full, as S1 asks (reader A: a cut contradicts "su contenido completo" with no budget that needs it, and points into a 9 MB JSON that is hard to read when Engram fails). The budget of S6.2 is on the head: the how-to, the state and the index, which a session reads in one go (10 to 20 KB per project today); the index gives each entry's line number, so a session opens one by offset. The how-to is self-sufficient: the fallback order, never edit by hand, the restore command.

### D3 The state section
The 3 newest `session_summary` observations of the project in full, "what we are doing" in their own words, not counted in the 100.

### D4 Selection by weight, hygiene (S5 "se higienice", S6.1)
From the project's important observations:
1. Drop what is no longer true: a `deleted_at`; and the target of a judged `supersedes` relation whose source is in the export, when the relation is not older than the target's last update (reader A: Engram revises an observation in place by topic_key, so a relation recorded before the target's revision says nothing about the revision).
2. One per topic_key: the newest `updated_at`.
3. Pinned first; then decisions and architecture, newest first, up to 70; then the others newest first until 100; slots one kind leaves unused go to the other.
The entries print newest first. On js-harness today the weight and the newest-100 rule nearly agree (70 and 30 against 69 and 31); the weight matters in a project whose recent work is mostly fixes, where newest-first would push its decisions out.
Hygiene is the selection plus two signals for the memory hygiene pass, none of them an edit of Engram: superseded, deleted and passive memories never reach the file; contested ones are marked, and the index counts them; a memory corrected in Engram is corrected here at the next backup.

### D5 When it is built (S4)
In `runBackup`, right after `exportEngram` accepted the export, at every run, even when the export did not change (the first run after this lands, or a new format). Pure functions in `bin/lib/backup-recent.mjs` build the text; the run writes it. The files are not in `manifest.files` (restore places only its own roots); the manifest gains `recent: [{ project, file, entries, observations, directories }]`: the project's total observations (the hook's baseline, D7) and the directories its sessions ran in (the hook's map, D7). `dueReason` treats a clone without `RECENT.md`, or a manifest without `recent`, as due. `runBackup` also rewrites RESTORE.md (it holds no time), so a clone made before this gets D9's lines. Every file carries `format: 1` in its first lines.

### D6 A wipe of one project is refused too
Both readers: the shrink guard compares the export's totals, so under scope `all` a project under a tenth of the store (a client's, 490 of 5,219) can be wiped whole, the export overwritten, and its file deleted. The guard gains a per-project check: a project that held at least 20 observations in the last export and now holds less than nine tenths of them refuses the export, as a total drop does, with its name and counts in last.json (private) and a count in the printed line. The refusal text changes for both: "if Engram was wiped, restore it first (`js-harness backup restore --from <clone> --merge`); `--allow-shrink` only when the drop is meant", since `--allow-shrink` after a wipe would replace the good copy (reader B).

### D7 Fallback order and the session-start notice (S5, S6.4)
Order: Engram; then the project's file; then `backup restore --merge` from the local clone, or from GitHub when the home is gone.
A SessionStart hook in both hosts, `js-harness backup --session-start || exit 0`, matcher `startup|resume|clear|compact` (after a compaction the notice is needed most), timeout 5, an entry of its own at the end of `entryComponents` (doctor's hook prints `systemMessage` only, by its contract). It reads `cwd` from the hook's input, and:
- No backup config: silent.
- The project: `ENGRAM_PROJECT`; else `.engram/config.json`'s `project_name` in the checkout; else the manifest's `recent[].directories` holding the cwd or its main checkout (longest match); else origin's repository name, else the main checkout's folder; lower case. No file for it: silent.
- `engram stats --project <p>` with a 3-second limit. Silent when the observations are at least nine tenths of the manifest's baseline. Otherwise it prints `hookSpecificOutput.additionalContext` with the reason in plain words ("Engram has no memory of p", "holds 12 of the 2,449 observations of the last backup", "did not answer within 3 seconds", "failed: …"): the file's path and the line range of its head, that the Engram protocol shown at this start is not working for this project, the order above, and the restore command with `--merge` and "never `--allow-shrink`". Counts alone cannot fire falsely on a healthy Engram: Engram's own start registers a session, which is why the baseline is observations, not sessions (reader A).
- The clone gone but the config there: the notice names the private repository and `gh api -H "Accept: application/vnd.github.raw" repos/<repo>/contents/recent/<file>`.
Codex: the resume hook already returns `additionalContext` on Codex's SessionStart; T6 checks once that Codex shows it, and falls back to `systemMessage` if not.

### D8 Freshness and proof (S5 "se actualice", S6.5, S6.6)
- `backup ready`: a `missing:` line, by count, when a file is absent or differs from what the clone's export rebuilds while the format is the same (the file is not the export's: a run failed half-way, or a hand edit); a `note:` line, never failing, when it was built by another format (the next run rebuilds it): a stale format loses nothing, the export holds it all (reader A).
- `doctor`'s backup row: `stale` when the last success has no `RECENT.md` in the clone.
- `backup verify --from`: the same comparison from the backup's own export: `ok recent: <n> files`, `FAIL` on a difference in the same format, a note on another format, so a restore after a reinstall with a newer harness does not fail a good backup.
- `backup status`: the line `recent: <n> files, newest <day>`.
- The probe, with its rubric written before the run (reader A: pasting the notice by hand proves nothing about the hook, and `--strict-mcp-config` keeps the engram plugin's hooks): (1) run the real `js-harness backup --session-start` in this checkout with `ENGRAM_DATA_DIR` on an empty scratch store, keep its stdout; (2) give it to `claude -p` with no engram MCP server and the engram plugin disabled, checked in its stream-json init event; (3) grade the answer against the rubric: the roadmap's current phase, three named decisions of the last week, the open feature. The transcript goes to the side-session notes folder; the Log gets one verdict per rubric item.

### D9 The protocol (S5)
- The js-harness skill: its description adds "and when Engram's memory is empty, failing or its tools are missing"; a section "When Engram fails": the order of D7, read the head then the entries you need, never edit the files, restore with `--merge` once Engram answers, never `--allow-shrink` after a wipe, and how to read the file from GitHub when the home is gone (`gh repo list --visibility private`, then the `gh api` line).
- RESTORE.md (rewritten by each run, D5): before any restore, `recent/<file>` on GitHub tells a session where the project stands.
- The orchestrator skill's "Before a reinstall": `backup ready` now also covers the fallback.

### Readers
- Reader A (adversarial) changed: the hook's trigger (a baseline, not zero: Engram's start registers a session), the supersedes rule (not when the target was revised after it), the per-project guard, the project resolution, the `compact` matcher and the timeout wording, Codex checked once, no cap on content and the head's line range, privacy of `ready`/`verify`/the probe, the probe itself, format versions, the numbers (322 KiB, 7 cut), build at every run, files out of `manifest.files`, reserved names and collisions.
- Reader B (omissions) changed: the same per-project guard and baseline, the refusal text against `--allow-shrink`, the skill's description so it loads when Engram fails, RESTORE.md rewritten by each run, the first run made due, the scope stated, contested entries marked, the home-gone path, `--merge` checked (it dedupes), `backup status`. Left out as scope creep: a foundations tier, model summaries, write-back to Engram, a SubagentStart notice.
- Still unguaranteed: Engram's project resolution has six sources and this reads four of them plus the directory map; a project renamed with `engram projects merge` finds its file only through the directory map.

## Tasks
- [x] T1 (design) this document, past two readers — inline
- [x] T2 (build) `bin/lib/backup-recent.mjs`: selection (D4), entry, state and head text with line numbers (D2, D3), index and names (D1), format — inline
- [x] T3 (build) the per-project guard and the refusal text (D6) — inline
- [ ] T4 (build) `runBackup` writes the files and the manifest's `recent`, rewrites RESTORE.md, `dueReason`; verify, ready, status, doctor (D5, D8) — inline
- [ ] T5 (build) `backup --session-start` and its two hook entries (D7) — inline
- [ ] T6 (docs) the skill, RESTORE.md text, help, README, SPEC, guide, roadmap (D9) — inline
- [ ] T7 (verify) gate, gentle-ai, Codex, the real run, `backup verify`, `ready`, Codex's notice, the probe (D8) — inline

## Log
- L1 (2026-10-22) His answer to Pregunta 45, verbatim in S1. The lead's brief and proposals are S2 and S6.
- L2 (2026-10-22) Two readers on the first design; what each changed is under "Readers". Code of T2 had started before them; it is reworked to this version. T2's rework was written before its new tests, so its RED was not observed apart; the index-line test then caught a real bug (multi-line content counted as one line).
- L3 (2026-10-22) T2 in 659c5538 (gentle-ai: medium, under_budget, not due). T3 in c507b45f (Risk: item 1, the guard of stored data: review it alone). `bin/lib/backup-fallback.mjs` and its test (7 pass) are written, uncommitted: project resolution, `readStats`, the notice (D7).

## Next step
Resume on branch feat/recent-memory in D:\js-harness\.claude\worktrees\backup-ready-a4ce86. Done: T1, T2 (659c5538), T3 (c507b45f); T5's pure part written (bin/lib/backup-fallback.mjs, uncommitted). Next, in order:
1. gentle-ai review of c507b45f alone (high-risk item 1): `gentle-ai review assess --cwd . --agent claude-code --base-ref 314ce05a --committed-only --json`, consent pre-granted (AGENTS.md); then the slice 2c1a257a..c507b45f; then `js-harness codex-review --base 2c1a257a`.
2. T4 in bin/backup.mjs: `dueReason` due when the clone has no RECENT.md or the manifest no `recent`; `runBackup` rewrites RESTORE.md from `restoreSteps(config.repo)` plus D9's line; `verify --from` uses `compareRecent` (bin/lib/backup-recent.mjs) on the backup's export: `ok recent: <n> files`, FAIL on `differ`, a note on `otherFormat`; `ready` a `missing:` by count for `differ`, a `note:` for `otherFormat` (readiness in bin/lib/backup-ready.mjs); `status` a `recent:` line; `backupHealth` stale when a success has no RECENT.md. Tests in bin/backup.test.mjs.
3. T5: `backup --session-start` in bin/backup.mjs: read stdin JSON `cwd`, config, manifest `recent`, `projectOf`, `engram stats --project <p>` with `STATS_TIMEOUT_MS`, `readStats`, `fallbackNotice`, print `{hookSpecificOutput:{hookEventName:'SessionStart',additionalContext}}`, exit 0 always; two entries at the end of `entryComponents` in bin/lib/manifest.mjs, matcher `startup|resume|clear|compact`, timeout 5; install/manifest tests.
4. T6 docs (D9), T7 verify (real run, verify, ready, Codex notice once, the probe with its rubric written first; transcript to the side-session notes folder).

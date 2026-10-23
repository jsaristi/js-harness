# Transcripts backup

The Claude Code transcripts backed up daily as text to a private GitHub repository of their own, split under GitHub's file limit, restored byte-identical.
Branch: feat/transcripts-backup. Delivery: ask-on-risk. Tests: `node --test` through `npm run check`. Engram mirror: `odd/transcripts-backup/tasks`.

## Goal
Every `~/.claude/projects/**/*.jsonl` has a copy in a private repository apart from the memory backup, refreshed once a day by `js-harness backup run`, and `backup restore --transcripts` puts each one back where it was, byte for byte.

## Why
The transcripts hold everything he wrote and every session's work, and no backup had them (`backup ready` listed them as `not copied`). Pregunta 51 named the trouble: a repository that stores a new copy each day fills up. His answer asked for them as plain text on GitHub, rebuilt into their format when needed, with nothing lost (S1); Pregunta 52 chose a private repository of their own (S2), so the memory backup stays small.

## Done when
- `node --test bin/backup.test.mjs bin/lib/backup-transcripts.test.mjs` exits 0
- `node bin/js-harness.mjs contract check odd/tasks/transcripts-backup.md` exits 0
- `npm run check` exits 0
- `node bin/js-harness.mjs backup verify --transcripts https://github.com/jsaristi/js-harness-transcripts-1.git` exits 0 on his machine, once the orchestrator approved the repository and the first push
- `node bin/js-harness.mjs backup ready` prints no `missing:` line about transcripts right after a `backup run --transcripts`

## In scope / Out of scope
- In: new `bin/lib/backup-transcripts.mjs` and its test; `bin/backup.mjs` (init, run, ready's wiring, restore, verify, status, doctor's row, RESTORE.md, help); `bin/lib/backup-ready.mjs`; their tests; README, the user guide, the roadmap line.
- Out: the other files beside the transcripts under `~/.claude/projects` (tool results, `.txt` and `.json`), which S1 and S2 do not name; blanking secrets in the transcripts (D5); the engram backup's repository, which gains only RESTORE.md's lines.

## Constraints
- The repository must read PRIVATE before every push, and the code refuses a public one — because the transcripts hold everything he wrote, unblanked (D5).
- No file in the repository reaches GitHub's 100 MB limit — because GitHub refuses the whole push.
- A restore is byte-identical, proven by sha256 — because his approval says "Se restauran idénticos" (S2).
- A transcripts failure never fails the memory backup — because the memory is the smaller, more important copy.
- Reuse the memory backup's guard, clone and push (`pushRefusal`, `pushClone`); no second way to find or push to a repository.
- Tests run in `mktemp -d` scratch homes, never his real home.

## Ask me before
Through the orchestrator (`js-harness notify --to orchestrator --kind question`), never him directly: creating the GitHub repository (Pregunta 54), and the first push of about 430 MB. Review consent is pre-granted.

## Specs
- S1 (his answer to Pregunta 51, transcript 908805db, line 20761): "No hay forma de pasarlos a texto plano subirlos a github y cuando se necesiten bajar se vuelven a acomodar en el formato que deber ir y que no se pierda la informacion?"
- S2 (Pregunta 52, line 20787): "¿subo los transcripts a GitHub como texto, en un repo privado aparte solo para ellos? Se restauran idénticos. Arranca en unos 430 MB y crece unos 400 MB por mes; GitHub avisa pasado 1 GB, así que cada tanto se abre un repo nuevo." → "Sí, repo privado aparte".
- S3 (the lead's brief): "backed up daily as text to a private GitHub repository of their own, separate from the engram backup repo, so that one stays small."
- S4 (the lead's brief): "GitHub refuses any file over 100 MB. Split such files by line into parts under that size."
- S5 (the lead's brief): "A restore rejoins the parts and puts every file back where it was, byte-identical."
- S6 (the lead's brief): "GitHub warns past 1 GB, so the design needs a way to roll to a new repository: by year, or when it passes a size."
- S7 (the lead's brief): "Fit it into the existing backup: `js-harness backup run`, `backup ready`, `backup verify`, `doctor`, and the restore notes." "Do not duplicate how the engram backup finds its private repository and pushes; reuse it."
- S8 (the lead's brief): "the repository must be private, and the code must refuse to push to a public one."

## Design

### D1 What a transcripts repository holds
A clone per repository under `~/.js-harness/memory-backup/transcripts/<name>`. Each transcript, by its path under `~/.claude/projects` (`<slug>/<session>.jsonl`, or `<slug>/<session>/subagents/<agent>.jsonl`), is stored at `<short slug>/<rest>`: the slug cut to 40 characters plus 8 hex of its hash, as `shortKey` does for worktrees, because a whole slug of a scratch folder is 150 characters and git on Windows cannot add a path past 260. `manifest.json` lists every file: its path under `projects`, its size and sha256, and its stored parts with theirs. It holds no time, so a day with no new transcript commits nothing. `.gitattributes` is `* -text`, so no line ending changes. `RESTORE.md` says how to put them back.

### D2 Parts (S4)
A file of `PART_MAX_BYTES` (40 MiB) or less is stored whole. A larger one is cut by line, each part ending at a newline and as long as it can be under the limit, stored as `<rest>.part001`, `.part002`, ...; a line longer than the limit is a part of its own, and a line of 100 MiB or more (`GITHUB_FILE_LIMIT`) cannot be stored, so it is named, not pushed. Cut greedily from the start, the parts of a file that only grows stay the same and only the last changes, so a day adds the new lines and not the whole file. 40 MiB and not 99: GitHub warns from 50 MiB.

### D3 When it runs (S3)
`backup run`, after the memory backup is pushed and its lock released, under a lock of its own (`transcripts.lock`, stale after 8 hours: three hour-long git steps per repository, two repositories after a rollover), at most once a day (`TRANSCRIPTS_EVERY_HOURS`), or at once with `backup run --transcripts`. A failure is recorded in last.json under `transcripts` and printed, and never fails the run. The push goes through `pushClone`, with its PRIVATE check, under a 60-minute limit, since a first push is about 430 MB. The Stop hook starts a run when the transcripts are due even if nothing else changed, unless a transcripts run holds their lock. A transcript Claude Code deleted since stays in the backup.

### D4 Rolling to a new repository (S6)
By size, not year: 1.7 GB of text packs to about 430 MB, and a year of growth passes 1 GB well before December. `config.json` keeps `transcripts.repos`, in order; the last is the one new transcripts go to. When its clone's objects (`git count-objects -v`) pass `TRANSCRIPTS_ROLL_BYTES` (800 MB), the run puts no new transcript in it, says so, and `doctor` and `ready` name the command that opens the next: `js-harness backup init --transcripts-repo <owner>/<name>-<n+1>`. Creating a repository is asked first, so the run never creates one. A transcript already in a repository stays in it as it grows; the 200 MB left under 1 GB covers sessions still open.

### D5 Secrets
Not blanked. His approval says the transcripts come back identical (S2), and blanking changes bytes. So the only guard is the one the memory backup has: the clone's every URL must be the configured repository on github.com, never `jsaristi/js-harness`, and `gh repo view` must read `PRIVATE` just before each push; a visibility that cannot be read refuses too.

### D6 Restore and proof (S5, S7)
`backup restore --transcripts <dir|git url> [--home <dir>]` rejoins each file into `<home>/.claude/projects/<path>`, checks its sha256 against the manifest before writing, never writes over a live file, and refuses a manifest path that leaves the projects folder or the clone (absolute, on a drive, or through `..`). `backup verify --transcripts <dir|git url>` rejoins every file in memory and checks each part's and each whole file's sha256: `ok transcripts: <n> of <n> files byte for byte`. `backup ready`, when transcripts are configured: a `missing:` line for a clone ahead of origin or never pushed, transcripts in no backup, and transcripts changed since; a transcript that only grew since and changed in the last 15 minutes is a `note:` (a session running now, often the one asking), so the check can pass from inside a session; a transcript with its entry's size and time is not read again. The `not copied:` line for transcripts goes once they are configured. `doctor`'s backup row is stale when transcripts are configured and none succeeded in 48 hours, a failure came after, or a rollover is due. RESTORE.md in the memory repository gains the restore line for each transcripts repository.

## Tasks
- [x] T1 (design) this document — inline, e4b37d3a
- [x] T2 (build) `bin/lib/backup-transcripts.mjs`: parts, rejoin, layout, manifest, the copy into a clone, verify and restore (D1, D2, D6), tests first — inline, 6baaf1c5
- [x] T3 (build) `bin/backup.mjs`: init, run with its lock and rollover, status, ready, doctor, verify, restore, RESTORE.md, help (D3, D4, D6), tests first — inline, 4addc8db and the review fixes
- [x] T4 (docs) README, the user guide, the roadmap line — inline, e4b37d3a (the roadmap box is ticked with T5)
- [ ] T5 (verify) gate, gentle-ai (items 1 and 2), Codex, the real init and first push after the orchestrator's yes, `verify --transcripts`, `ready` — inline

## Log
- L1 (2026-10-23) The lead's brief: build the transcripts backup Sebastián approved as Pregunta 52 ("Sí, repo privado aparte"); his words are S1 and S2, the brief's S3-S8. Measured today: 834 `.jsonl` under `~/.claude/projects` (161 at `<slug>/<session>.jsonl`, 673 under `<session>/subagents/`), 1.7 GB, the largest 47 MB.
- L2 (2026-10-23) Pregunta 54 sent to the orchestrator: create `jsaristi/js-harness-transcripts-1`. Building does not wait on it.
- L3 (2026-10-23) T2: RED seen (the module did not exist), then 13 tests pass: split and rejoin byte-identical, the 100 MiB limit and a line at it refused, prefix-stable parts, the stored path, a restore that never writes over a live file and refuses a part that changed, the repository a file stays in, a full one. In 6baaf1c5 (gentle-ai: medium, under_budget). The gate caught "Pure file work" in the header of a module that imports node:fs (`bin/conventions-pure.test.mjs`); the header now says what it reads and writes.
- L4 (2026-10-23) T3: six command tests written first and seen failing against the code before it (37 pass, 6 fail): init refusing a public repository and the memory one, the daily run and `--transcripts`, the refusal on a public or unreadable visibility with the memory backup going on, the rollover, ready/verify/restore, the hook. Choices made while building: `privateClone` is the memory backup's init made a function, now used by both, and refuses `jsaristi/js-harness` before any `gh` call; `pushClone` takes a timeout; `verify` takes one of `--from`, `--summary`, `--transcripts`, refusing two, so none is silently ignored; a manifest entry keeps the file's time when it was copied, so a restore gives Claude's session list its order back; a test injects `transcriptsRollBytes = 0`, so a repository is full at `>=` its limit.
- L5 (2026-10-23) Pregunta 53 (transcript 908805db, line 20922), checked with `sessions --quote`: "Sí, crealo y subí" to creating the private repository and pushing the first copy (~430 MB). The orchestrator: use `jsaristi/js-harness-transcripts-1`, withdraw Pregunta 54 citing 53, push once tests and reviews pass, ask nothing more of him. T2 in 6baaf1c5, T3 in 4addc8db (gate PASS on CI, 270s); docs commit's gate running.

- L6 (2026-10-23) gentle-ai reviewed 6baaf1c5^..e4b37d3a (1099 lines, high, escalated on item 1) with the risk, resilience and reliability lenses: approved and acknowledged (lineage review-716e93f69d3bcd20, authority burned), with eight informational findings. Fixed before the real push, tests first (RED seen: 2 lib tests and the hook test failing): the hook started a full memory backup every 30 minutes for as long as a first push ran, since nothing is recorded until it ends, so it now skips the transcripts' day while their lock is live; the lock went stale at 2 hours while one run can take three hour-long git steps per repository, now 8 hours; a lock that cannot be taken is recorded as a failure, so the hook does not find them due again; a manifest path that leaves the projects folder or the clone is refused by verify and restore; the clone behind `verify` and `restore --transcripts` gets the transcripts' 60-minute limit; `ready` no longer hashes a transcript whose size and time are its entry's; `restore` with both sources no longer calls the first one's `done` twice; a test pins `verify`'s one-source refusal, and the README says it. While writing the size-and-time test: `stat.mtime` rounds to the millisecond and the manifest's ISO time truncates, so the test sets the entry's own time, and the code compares within 1 ms.
- L7 (2026-10-23) The fixes are 022cabb6. gentle-ai reviewed e4b37d3a..022cabb6 (high, item 1; the same three lenses): approved and acknowledged (lineage review-284ec6a838b2a833). All three lenses found the same hole: the path guard's split regex had lost its backslash to the shell heredoc that wrote it, so a `..\` path passed it on Windows. Fixed with the Edit tool, tests first (RED seen): backslash cases for an entry and a part, and every path is checked before any file is written, so a refused manifest restores nothing. Left as written: the 8-hour lock also delays recovery from a run that died mid-push (checking the pid would shorten it; the daily cadence and doctor's 48 hours already cover it).
- L8 (2026-10-23) 5007334d: gentle-ai's risk lens rechecked it (lineage review-9401a7afc50ab35a): approved and acknowledged, no findings. `jsaristi/js-harness-transcripts-1` created by `backup init --transcripts-repo` (Pregunta 53), reading PRIVATE; nothing pushed yet. Codex reviewed dea129b..5007334d in 4 parts (recorded): two parts clean, four findings, all fixed, tests first (RED seen for three): a copy deleted the obsolete parts a manifest names without checking them, so a tampered manifest could delete a file outside the clone (P1), now every manifest path is checked before any change; an unchanged transcript whose stored part was gone from the clone was skipped, and `git add -A` then pushed the deletion (P2), now a missing part is written again; two owners' repositories of one name would share a clone (P2), now `init` refuses the second before any call; last.json is updated by the memory run and the transcripts run under separate locks (P2), now written whole and renamed into place so a read never sees it half written. That last one has no deterministic test (a race between processes); the residual window is two synchronous calls, a read and a rename, which both runs make in one tick.
- L9 (2026-10-23) The Codex fixes are 439a4312. gentle-ai reviewed 5007334d..439a4312 (risk and reliability): approved and acknowledged (lineage review-e93a2780db1aabfc), with three notes on the atomic write: a rename over an open file can fail for a moment on Windows, a failed write left its partial file, and no test pinned it. Codex rechecked 5007334d..e8764612 (recorded): three findings fixed, the shared-state one not, since the rename stops a half-written read but not two runs each writing back their own copy. So every update of last.json (the memory run's record, the summary's note, the transcripts' note) now reads, changes and writes it under `last.json.lock` (stale after 30 seconds, waited for up to 10), and the rename is tried again on EPERM, EACCES or EBUSY, its partial file removed either way. Test first (RED seen: the lock a dead run left was never taken over): a run with a stale lock in place records both runs and leaves no lock or partial file.

## Next step
Resume on branch feat/transcripts-backup in D:js-harness.claudeworktreesclean-5f4555. In order:
1. Commit the review fixes and this document; gentle-ai on that commit (items 1 and 2), consent pre-granted.
2. `js-harness codex-review --base 6baaf1c5^`.
3. Real run: `node bin/js-harness.mjs backup init --transcripts-repo jsaristi/js-harness-transcripts-1`, then `node bin/js-harness.mjs backup run --transcripts` in the background (60-min push), then `backup verify --transcripts https://github.com/jsaristi/js-harness-transcripts-1.git` and `backup ready`; tick T5 and the roadmap line.
4. PR on main with the gentle-ai line; `js-harness notify --to orchestrator --kind ready --pr <n>`.

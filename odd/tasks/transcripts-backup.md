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
`backup run`, after the memory backup is pushed and its lock released, under a lock of its own (`transcripts.lock`, stale after 2 hours), at most once a day (`TRANSCRIPTS_EVERY_HOURS`), or at once with `backup run --transcripts`. A failure is recorded in last.json under `transcripts` and printed, and never fails the run. The push goes through `pushClone`, with its PRIVATE check, under a 60-minute limit, since a first push is about 430 MB. The Stop hook starts a run when the transcripts are due even if nothing else changed. A transcript Claude Code deleted since stays in the backup.

### D4 Rolling to a new repository (S6)
By size, not year: 1.7 GB of text packs to about 430 MB, and a year of growth passes 1 GB well before December. `config.json` keeps `transcripts.repos`, in order; the last is the one new transcripts go to. When its clone's objects (`git count-objects -v`) pass `TRANSCRIPTS_ROLL_BYTES` (800 MB), the run puts no new transcript in it, says so, and `doctor` and `ready` name the command that opens the next: `js-harness backup init --transcripts-repo <owner>/<name>-<n+1>`. Creating a repository is asked first, so the run never creates one. A transcript already in a repository stays in it as it grows; the 200 MB left under 1 GB covers sessions still open.

### D5 Secrets
Not blanked. His approval says the transcripts come back identical (S2), and blanking changes bytes. So the only guard is the one the memory backup has: the clone's every URL must be the configured repository on github.com, never `jsaristi/js-harness`, and `gh repo view` must read `PRIVATE` just before each push; a visibility that cannot be read refuses too.

### D6 Restore and proof (S5, S7)
`backup restore --transcripts <dir|git url> [--home <dir>]` rejoins each file into `<home>/.claude/projects/<path>`, checks its sha256 against the manifest before writing, and never writes over a live file. `backup verify --transcripts <dir|git url>` rejoins every file in memory and checks each part's and each whole file's sha256: `ok transcripts: <n> of <n> files byte for byte`. `backup ready`, when transcripts are configured: a `missing:` line for a clone ahead of origin or never pushed, transcripts in no backup, and transcripts changed since; a transcript that only grew since and changed in the last 15 minutes is a `note:` (a session running now, often the one asking), so the check can pass from inside a session. The `not copied:` line for transcripts goes once they are configured. `doctor`'s backup row is stale when transcripts are configured and none succeeded in 48 hours, a failure came after, or a rollover is due. RESTORE.md in the memory repository gains the restore line for each transcripts repository.

## Tasks
- [ ] T1 (design) this document — inline
- [ ] T2 (build) `bin/lib/backup-transcripts.mjs`: parts, rejoin, layout, manifest, the copy into a clone, verify and restore (D1, D2, D6), tests first — inline
- [ ] T3 (build) `bin/backup.mjs`: init, run with its lock and rollover, status, ready, doctor, verify, restore, RESTORE.md, help (D3, D4, D6), tests first — inline
- [ ] T4 (docs) README, the user guide, the roadmap line — inline
- [ ] T5 (verify) gate, gentle-ai (items 1 and 2), Codex, the real init and first push after the orchestrator's yes, `verify --transcripts`, `ready` — inline

## Log
- L1 (2026-10-23) The lead's brief: build the transcripts backup Sebastián approved as Pregunta 52 ("Sí, repo privado aparte"); his words are S1 and S2, the brief's S3-S8. Measured today: 834 `.jsonl` under `~/.claude/projects` (161 at `<slug>/<session>.jsonl`, 673 under `<session>/subagents/`), 1.7 GB, the largest 47 MB.
- L2 (2026-10-23) Pregunta 54 sent to the orchestrator: create `jsaristi/js-harness-transcripts-1`. Building does not wait on it.

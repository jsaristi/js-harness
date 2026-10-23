# JH 47 · transcripts backup to a private repo

## Goal
Back up `~/.claude/projects/**/*.jsonl` daily, as text, to a private GitHub repository of their own, split under GitHub's file limit and restored byte-identical, from the lead's brief (`odd/tasks/transcripts-backup.md`, L1).

## The user's words
- Pregunta 52 (transcript 908805db, line 20787): "Sí, repo privado aparte".
- Pregunta 53 (transcript 908805db, line 20922, read with `js-harness sessions --quote`): "Sí, crealo y subí".

## Delivered
- PR jsaristi/js-harness#513, open and mergeable, branch `feat/transcripts-backup`: 11 commits, 6baaf1c5..abee30ae.
- `jsaristi/js-harness-transcripts-1`, PRIVATE: 834 transcripts pushed in 6 min 9 s; `backup verify --transcripts https://github.com/jsaristi/js-harness-transcripts-1.git` printed `ok transcripts: 834 of 834 files byte for byte`; `backup ready` exited 0.
- Feature document `odd/tasks/transcripts-backup.md`: T1-T6 closed; the roadmap line is ticked.

## Decisions
- Rollover by size (800 MB of objects), not by year; parts of 40 MiB, cut by line from the start of the file (this session, D2 and D4).
- No secret blanking, so a restore is byte-identical; the PRIVATE check before each push is the guard (this session, D5).
- The transcripts run records into `transcripts.json`, which only it writes, so no lock is shared between two writers (this session, L10).

## Failures and lessons
- A bash heredoc ate the backslash of a regex, so the path guard missed `..\` on Windows; all three gentle-ai lenses found it (L7). Lesson: write regexes and backslashes with the Edit tool.
- A lock shared by two writers needed a takeover that could not race; both reviewers found the race (L10). Removing the shared writer fixed it.
- A flaky test: `stat.mtime` rounds to the millisecond while the manifest's ISO time truncates (L6).

## Left
- The other files under `~/.claude/projects` (tool results, `.txt` and `.json`), and a pid liveness check for a transcripts lock left by a dead run: follow-ups in the PR body, for the lead.
- Merging #513: the lead.

## Cost
- 02:25 to 03:30 local on 2026-10-23; about 88% of the context at the end.
- gentle-ai: six reviews. Codex: four recorded reviews. Pre-commit gates: eight, all passing on GitHub's machines.

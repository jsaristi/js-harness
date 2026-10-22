# JH 44 · RECENT.md, respaldo legible de engram

File: docs/sessions/2026-10-22-jh-44-recent-md-respaldo-legible-de-engram.md.

## Goal
Build the readable fallback of Engram memory: `RECENT.md` and a file per project in the private backup repository, and the protocol that builds it, keeps it clean and current, and uses it when Engram fails. Opened by the lead (JH ORQ) as a side session; the opening is stored as "JH 44 · RECENT.md, respaldo legible de engram".

## The user's words
His answer to Pregunta 45, quoted verbatim in `odd/tasks/recent-memory.md` S1 (transcript 908805db-d0b9-4c2f-a9e6-f828b6bf1e41, line 18060, 2026-10-22T04:32:36Z): "RECENT.md en el repo privado del backup, con las últimas 100 memorias importantes y su contenido completo, regenerado en cada backup. … cuando el sistema se quede sin memorias osea engram, este busque el archivo recent …"

## Delivered
- jsaristi/js-harness#502, merged to main as b7fe295 (reported by the lead).
- Commits: 314ce05a (design), 659c5538 (T2 build), c507b45f (T3 per-project guard), 03221112 (project resolution and stats), 4d8625ed (T4 verify/ready/status/doctor), 39ab0e7c (Codex fixes), 26a7a0e2 (T5 SessionStart hook on both hosts), 2a7bccf4 (T6 protocol docs), 3bb23ec7 (T7 proof).
- Feature document `odd/tasks/recent-memory.md`, T1-T7 checked; mirrored to Engram topic `odd/recent-memory/tasks` (#5235).
- The real backup ran: 5229 observations, 9 project files; `backup verify --from https://github.com/jsaristi/js-harness-memory.git` printed `ok recent: 10 of 10 files rebuilt from the export`; `backup ready`: yes.

## Decisions
- The user: Pregunta 45 (S1) — private repo, last 100 important observations in full, rebuilt at every run, used when Engram fails.
- The lead: content stays private, code and protocol public (S2); proposals 1-6 (S6).
- This session, recorded in the feature document: D1-D9 after two readers; a backup with no RECENT.md is a `note` in `verify` and `missing` in `ready` (L5); the Codex notice is not forced by writing hook trust, which is the user's choice (L10).

## Failures and lessons
- The Stop hook offered the whole branch for review; per AGENTS.md only its read-only status ran, since each slice was reviewed apart.
- Codex found three P2 bugs (unquoted restore path, colliding file names, a folded timeout); fixed in 39ab0e7c with tests seen failing first (L6).
- The first T5 commit failed on bin/clean-home.test.mjs, which lists SessionStart entries; the list was updated (L8).
- The probe's first input, with `\\` in Git Bash, reached node as invalid JSON and the hook stayed silent by design; a silent hook proves nothing, so the probe fed it from a file (L11).
- In the probe answer, the model called two PRs open that the file did not show as open; recorded, not counted (L11).

## Left
- The owner: trust the new `backup --session-start` hook once in Codex's hook review; until then Codex shows no notice (L10).
- The lead: in Codex, SessionStart index 3 (`js-harness resume --hook`) is untrusted, so it may never have run there (L10).

## Cost
- Time: opening 05:23 local, ready notice 05:34 local (2026-10-22T10:34:19Z), landed while this session waited; context 34% at the ready notice, after one host compaction.
- Reviews: gentle-ai three (lineages review-c868f912f2c4b9f1, review-130f00580471f1ff, review-17b9bb271e8b95b0); Codex two passes (314ce05..4d8625e, 455k input tokens; 4d8625e..2a7bccf, 55k).
- One probe run of `claude -p --model sonnet`: 3 turns, $0.34 at list price.
- Gate runs: one per commit, plus `npm run check` for T7.

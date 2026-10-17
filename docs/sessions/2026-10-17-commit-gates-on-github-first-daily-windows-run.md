# Commit gates on GitHub first, daily Windows run

File: docs/sessions/2026-10-17-commit-gates-on-github-first-daily-windows-run.md. Facts with their evidence (a pull request, a commit, a path:line, a command and its output), not prose: the file is read later to reverse-engineer how the work went. Commit and push it, then close with js-harness notify --to orchestrator --kind closed --summary <this file> "<what you delivered>".

## Goal
- A work session started by the lead (JH ORQ, `local_bd0ae465-dea2-48dc-91c5-964f400801be`) to build items C and E of the throughput plan v3 and the daily Windows run R1, from `side-session-notes\local_053e19d7-d91d-4aa6-a210-3f014cf86050\throughput-v3-plan.md`. The brief is quoted verbatim as L1 of `odd/tasks/commit-gates-first.md`.
- Session transcript `987cadde-2c50-422a-a8aa-01c09389e68a`; app worktree `D:\js-harness\.claude\worktrees\compassionate-allen-842d94`. E was built in `D:/js-harness-worktrees/wrapped-commit-hint` (L5).

## The user's words
- Sebastián wrote nothing in this session; every input came from the lead, hooks and notifications.
- His answer behind R1, from `js-harness sessions --quote e152c9d8-53bc-4366-8fa5-526b1576bcb6 18165` (2026-10-17T02:14:08Z), to "¿Cada cuánto corre la suite de Windows?": tapped "Una vez por día (Recomendada)" (options: "Una vez por día (Recomendada) | Cada N tandas | Solo corregir el README").
- His choice for C's stuck gentle-ai review, relayed by the lead: "Reportar y seguir" (L6).
- His order behind this file, from `js-harness sessions --quote e152c9d8-53bc-4366-8fa5-526b1576bcb6 21112` (09:20:53Z), begins "Siempre archiva cuando ya hayan terminado y haz que hagan un resumen siempre que terminen".

## Delivered
Pull requests on jsaristi/js-harness, all merged (`gh pr view <n> --json state,mergedAt` on 2026-10-17):
- #353 (04:28:44Z, `760e8fec`): C, every commit's tests go to GitHub first, bounded by a rule (T2).
- #354 (04:58:43Z, `08952f4a`): E, the guard hints when a commit is wrapped in `js-harness gate --` (T3; commits 8ba73c22, fix 4665c503).
- #367 (06:53:58Z, `e234dfcd`): R1, `.github/workflows/windows-daily.yml` (cron `23 7 * * *` and `workflow_dispatch`), the reader `bin/lib/windows-daily.mjs`, the command `js-harness windows-daily`, and the heartbeat's `--windows` check (T4; commits 8b96b9d2, e251c12e, 1c7d985d, eeeeb2e5, then the docs commits 1fea4150 and af9f5c77).
- #369 (07:27:54Z, `a66de1d9`): the first daily run recorded (L14) and the feature closed (commit ac57153e).
- First run on main, the one hand dispatch after #367: run 39011662138, success. It held 6,116 tests: 6,105 passed, 0 failed, 11 skipped. The job took 12 min 28 s. `js-harness windows-daily` read it as "passed" and told nothing.
- Feature document: `odd/tasks/commit-gates-first.md`, T1-T4 checked, log L1-L14.
- gentle-ai: issue #5422 got one occurrence comment (issuecomment-6229376872), after his "Reportar y seguir" (L6).

## Decisions
- His: the Windows suite runs once a day (above), recorded at `docs/ROADMAP.md:69`. The daily run replaces the per-batch hand run that no land made (`docs/ROADMAP.md:986-989`).
- The lead's:
  - R1 waited for first-version T6f (PR 360).
  - The two land refusals were fixed by adding gentle-ai lines: L13 for #367, and the PR body for #369.
  - This session runs the one `gh workflow run windows-daily.yml` on main.
- This session's (each in `odd/tasks/commit-gates-first.md`, "R1, version 3" and L8):
  - The suite step sets TEMP/TMP to `runner.temp`.
  - gh is called with the gate's spawner (60 s, 64 MB).
  - A red run is silent only when the files are found and all are quarantined.
  - Each run is told once, through a `wx` marker keyed by run id and attempt.
  - `cancelled` and `timed_out` count as red.
  - A schedule with no run in 26 h is told as stale, apart from a red run.
  - A notice that fails is retried.

## Failures and lessons
- **C's gentle-ai review** timed out: the bound status failed 8 times at about 26 s each, with `operation_timeout` (L5). It was reported to gentle-ai #5422 and declined for that candidate on his choice (L6).
- **Windows TEMP:** the first Windows trial (39007607383) failed 168 of 6,067 tests, because GitHub's Windows runner sets TEMP as an 8.3 short path (`C:\Users\RUNNER~1`). Fixed with `TEMP/TMP: ${{ runner.temp }}`. The second trial (39008562752) failed only the expected workflow-shape test (L8, L9).
- **`gh repo view`** has no `--repo` flag. The real smoke run found it, and `bin/lib/windows-daily.test.mjs` pins it.
- **Wrong base for the review:** gentle-ai reviewed 8b96b9d2 against a newer main, so PRs 363 and 364 read as reverted. The correction was a merge of main (e251c12e). The correction plan was run with one added `--cwd` token, against the contract; logged in L10.
- **Findings after review:**
  - gentle-ai: a red run already told hid a stopped schedule, and a failed notice kept its marker. Both fixed test first in 1c7d985d.
  - Codex P2: the notice ignored `--home`. Fixed in eeeeb2e5.
- **Land refusals:**
  - #367 was refused for lacking written gentle-ai evidence, so L13 names each commit.
  - #369 was refused for lacking a gentle-ai line in its body, so the line was added.
  - Lesson: every PR carries its gentle-ai line, even a passive docs one.
- **Heredocs** ate backslashes in regexes. Such text went through Edit instead.

## Left
- Nothing in this feature. The schedule runs the suite daily from 2026-10-18, 07:23 UTC, and the lead's heartbeat reads each run (`loop heartbeat --windows`).
- Accepted and logged in L10: a slow GitHub can hold one heartbeat tick for up to about 4 minutes, once an hour.

## Cost
- **Time:** first notice to the lead at 2026-10-17T03:25:43Z; last before this file at 07:13:26Z (`C:\Users\Oficina\.js-harness\channel\D--js-harness.jsonl`, 11 notices from 987cadde). Closed after 10:52Z.
- **Context:** compacted twice by the host, at 05:55Z and about 06:48Z; it had passed the context pause at 06:40Z, holding 302k tokens. The share at the end was not read.
- **Reviews, gentle-ai:**
  - C: preflight, START, then 8 timeouts, then declined.
  - R1: one full review of 8b96b9d2 (lenses risk, resilience, reliability), one correction, approved and acknowledged (lineage review-64a52f3e0ae9f6fa).
  - Assessed, not due: E's fix, 1c7d985d, eeeeb2e5, ac57153e.
- **Reviews, Codex:** C, 1 run; E, 1 run plus a recheck; R1, 1 run in 3 parts (374,871 input tokens, 90 s) plus a recheck. All recorded.
- **Gates:** on GitHub, from 105 s to 148 s each (C 148 s, E 105 s and 128 s, R1's merge 138 s).
- **GitHub Actions:** two Windows trials (14.5 min and 12.6 min) and the first daily run (12 min 28 s).
- **Spend:** 0 $, stated in each PR.

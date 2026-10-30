# JH 64 · drop CircleCI: test only on GitHub

## Goal
Remove CircleCI completely and make GitHub Actions the only CI, the merge queue's candidate test included. Opening: `js-harness sessions --opening 'JH 64 · drop CircleCI: test only on GitHub'`.

## The user's words
"el repositorio es publico asi que no vamos a volver a utilizar circleci eso lo vamos a eliminar por completo vamos a hacer todos los test unicamente en github" (the lead's transcript 0f71b2c6, line 1971).

## Delivered
- PR 610, merged 2026-10-27T20:30:51Z (main dc91e4e): gate.yml runs for a push to `queue/` too; `merge-queue --land` judges the newest gate.yml run of its queue branch at the candidate (`actionsState`, bin/merge-queue.mjs); commits 87c6f87, 20c89fa, 2d8b047.
- PR 611, merged 2026-10-27T20:43:42Z, the first land tested by GitHub Actions alone: .circleci/config.yml and scripts/circleci-config.test.mjs removed; commits 9030a29, 09d685a.
- Feature document odd/tasks/drop-circleci.md, T1 to T4 done; roadmap Decided row "CI".

## Decisions
- Two chained slices (this session, odd/tasks/drop-circleci.md L3): a land runs main's bin/, which waited for CircleCI, so slice A kept the CircleCI config to land through the old queue.
- New land records name the CI phase `actions`; old ones keep `circleci` (L4, L6).

## Failures and lessons
- Codex P2 on 87c6f87: the queue judged every GitHub Actions check run on the sha (a windows-daily dispatch on a queue ref could decide a land). Fixed in 20c89fa, rechecked fixed.
- The first gate of 87c6f87 was red: a module line ceiling to lower (bin/conventions-structure.test.mjs). Only the touched test files had run locally.
- The feature document was edited while Codex reviewed slice B, so that run wrote no record; it ran again on a clean tree (L10).

## Left
- His, outside the repository: disconnect the CircleCI project on circleci.com; remove the CircleCI GitHub app or OAuth grant and any CircleCI token or webhook.
- A project with no workflow for `queue/**` still waits 30 minutes and exits 5 in `merge-queue --land` (T4), unowned.

## Cost
First notice 14:34 local, last 15:36 local (ready for 611). Context about 62% at the last notice. gentle-ai: three reviews of four lenses (87c6f87; cf6c6d5..20c89fa; 9030a29). Codex: five runs (cf6c6d5..87c6f87, 87c6f87..20c89fa, two of 2d8b047..9030a29 with no record, 2d8b047..09d685a), 42,005 to 211,822 input tokens each. Gate runs on GitHub: six commits, one red.

CircleCI leaves: GitHub Actions runs every test of this repository, the merge queue's candidate test included.
Branch: claude/drop-circleci-62f2f7 (slice A), then a branch stacked on it (slice B). Delivery: chained-pr. Tests: `node --test`.

## Goal
No CircleCI anywhere: `merge-queue --land` tests its candidate with the GitHub Actions run of
`.github/workflows/gate.yml` on the pushed `queue/*` branch, and the repository holds no CircleCI file.

## Why
CircleCI came in on 2026-10-14 (odd/tasks/merge-queue.md, L3 and L5) because the repository was private: a GitHub
Actions run spent minutes of an account with 2,000 a month and no card (odd/tasks/drop-github-gate.md, Why), while
CircleCI builds any pushed branch for free credits. The repository is public since 2026-10-16 (docs/ROADMAP.md,
Decided, "Name, home"), so GitHub's runs cost nothing, and the commit gate and the daily Windows suite already run
there. Two systems to keep bounded, configured and credentialed for one job is a cost with no reason left.

## Done when
- `node --test bin/merge-queue.test.mjs scripts/github-workflows.test.mjs bin/js-harness.test.mjs` exits 0
- `npm run check` exits 0
- `git ls-files .circleci scripts/circleci-config.test.mjs` prints nothing (slice B)

## In scope / Out of scope
- In: .github/workflows/gate.yml, .github/workflows/windows-daily.yml (comments), bin/merge-queue.mjs and its test, bin/js-harness.mjs (help) and its test, scripts/github-workflows.test.mjs, README.md, docs/ROADMAP.md, docs/SPEC.md, docs/FAILURES.md (a control that names a renamed test), bin/check.mjs (a comment), bin/check-shadow.test.mjs (a comment), scripts/inventory.mjs and its test; slice B removes .circleci/config.yml and scripts/circleci-config.test.mjs.
- Out: bin/lens* and F8 S1's files (JH 62, PR 608). The CircleCI project on circleci.com and any CircleCI token, app or webhook on GitHub: credentials outside the repository, his to remove. Historical mentions (docs/sessions/, odd/tasks/ logs, FAILURES sightings, test comments that cite a CircleCI job as evidence): they record what happened.

## Constraints
- Each slice lands through the queue that main holds when it lands — because a land runs main's bin/ (`staleBin`), so the slice that teaches the queue GitHub Actions keeps .circleci/config.yml for its own land, and only the next slice removes it.
- gate.yml stays bounded as scripts/github-workflows.test.mjs holds it: push to named branches only, read-only token, no secret, pinned actions — because the repository is public.
- Land records stay readable: old records keep their `circleci` phase and field; new ones write `actions` — because the throughput command reads every record by its phase name.

## Ask me before
- Nothing: he gave the decision (L1) and full autonomy while away; what is his outside the repository is listed in the summary.

## Specs
- S1. His words (the lead's transcript 0f71b2c6, line 1971, read with `js-harness sessions --quote`): "el repositorio es publico asi que no vamos a volver a utilizar circleci eso lo vamos a eliminar por completo vamos a hacer todos los test unicamente en github".
- S2. `merge-queue --land` waits for the GitHub Actions run of the candidate's `queue/*` branch, a run of gate.yml whose checkout is the candidate itself (main as it would be), and lands only on its green.
- S3. The repository holds no CircleCI configuration or test of one, and what names CircleCI as current says GitHub Actions.
- S4. What init, install and update write into a project holds no CircleCI file and no CircleCI wait; uninstall still undoes it.

## Tasks
- [x] T1 (S2, kind: build): gate.yml runs for a push to `queue/` too; the queue reads GitHub Actions' check runs of the candidate. Route: inline. Slice A. RED: `node --test scripts/github-workflows.test.mjs bin/js-harness.test.mjs bin/merge-queue.test.mjs`, 3 failures (the trigger list lacked `- 'queue/**'`; the help named CircleCI; `actionsState` not exported); GREEN 183 of 183.
- [x] T2 (S1, S2, kind: docs): help, README's merge-queue section, the roadmap's decision (Decided, CI), the FAILURES control that names the renamed test. Route: inline. Slice A.
- [ ] T3 (S3, kind: build): .circleci/config.yml and scripts/circleci-config.test.mjs removed; inventory, SPEC, comments. Route: inline. Slice B, after A lands.
- [x] T4 (S4, kind: verify): what init, install and update write, searched for CircleCI. Route: inline. `git grep -il circleci -- . ':!odd' ':!docs/sessions'` names no installer, template or manifest file (only the files of In scope), and `git grep -n -i workflows -- bin ':!*.test.mjs'` shows no code that writes a workflow: a project gets no CircleCI file and no CI file at all, so uninstall has nothing new to undo. A project's own `merge-queue --land` waits for GitHub Actions on its `queue/*` branch; a project with no workflow for `queue/**` still gets no answer and exits 5 after 30 minutes, as it did with CircleCI (a follow-up, not this feature).

## Log
- L1. 2026-10-27, his decision, typed (the lead's transcript 0f71b2c6, line 1971): quoted in S1. The lead checked `gh repo view`: PUBLIC.
- L2. 2026-10-27, the reason CircleCI came in, read: odd/tasks/merge-queue.md L3 (gate.yml then ran on `pull_request` only; a `queue/**` push trigger was one option) and L5 (his choice of CircleCI, a second system for the queue's full runs); odd/tasks/drop-github-gate.md, Why ("spends Actions minutes of an account with 2,000 a month and no card"). The reason is gone since the repository went public on 2026-10-16.
- L3. 2026-10-27, two slices, decided: a land runs main's bin/, which today waits for CircleCI's run of the candidate. A single pull request that removed .circleci/config.yml would give the old queue no CircleCI run to wait for, so it could never land. Slice A adds the `queue/**` trigger and the GitHub Actions read and keeps the CircleCI config; once A is on main (and the installed copy refreshed), slice B removes CircleCI and lands through the new queue.
- L4. 2026-10-27, slice A built (T1, T2, T4). A record's phase and field are `actions` from now on; the records before keep `circleci`, and `bin/lib/throughput.mjs` counts phases by their name, so both read. The queue reads only the check runs of GitHub's own app (`github-actions`), so a CircleCI run still posted on a candidate while .circleci/config.yml exists neither greens nor reds it.
- L5. 2026-10-27, 87c6f87 (slice A) green on the gate; the first try was red on one convention, bin/merge-queue.mjs down to 1056 lines with its ceiling still 1057 (bin/conventions-structure.test.mjs), lowered in the same commit. gentle-ai on 87c6f87 (lineage review-19442b9476978a28, lenses risk, resilience, readability, reliability): approved and acknowledged, five advisories. Codex on cf6c6d5..87c6f87: incorrect (0.9), one P2: the queue judged every GitHub Actions check run on the candidate's sha, so a windows-daily.yml run dispatched by hand on a queue/* ref could hold or decide a land. gentle-ai's R4-stale-sha-check-runs is the same flaw seen from a re-land of one sha: an old red run of that sha would turn the new land red.
- L6. 2026-10-27, the fix (commit after 87c6f87): the queue reads `actions/runs?head_sha=<candidate>&branch=<queue branch>&event=push` and judges only the newest run whose path is .github/workflows/gate.yml on that branch and sha (`actionsState`); a queue branch's name holds the land's time, so a re-land of one sha never reads an older land's run. Advisories taken: R2-vacuous-refusal-test and R3-negative-workflow-test-weakened (the refusal fixture now carries `queue/**`, so `pull_request_target` is its one difference), R3-land-record-rename-unproved (a throughput test with a `circleci` and an `actions` record), R2-record-field-rename (the comment says nothing reads the top-level field: `git grep` of `.circleci`/`record.actions` in bin and scripts finds only the writer). The tests were written before the code, but not run red on their own before it.

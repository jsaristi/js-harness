A local batching merge queue: the only way code reaches main, tested once as the main it will be.
Branch: feat/merge-queue (builds on `js-harness merge-ready`, feat/merge-ready). Delivery: ask-on-risk. Tests: `node --test`.

## Goal
`js-harness merge-queue` merges the ready pull requests into main as one candidate tested once locally and
once on GitHub, pushes main only when both are green, and finds the pull request that broke a red one.

## Why
Each code merge makes every other open pull request's green run stale, and every reopen buys another run:
205 Actions minutes on 2026-10-14 alone, of the account's 2,000 a month. GitHub's own merge queue is not
offered for a private personal repository. A candidate of main plus the ready pull requests, tested as one,
is one run for a batch instead of one for each pull request after each merge.

## Done when
- `node --test bin/merge-queue.test.mjs bin/lib/merge-queue.test.mjs` exits 0
- `npm run check` exits 0
- `js-harness merge-queue --dry-run` lists the candidate it would build and pushes nothing

## In scope / Out of scope
- In: bin/merge-queue.mjs, bin/lib/merge-queue.mjs, their tests, bin/js-harness.mjs, README.md, the pre-push hook's refusal of a push to main from anywhere but the queue, this document.
- Out: .github/workflows/gate.yml (L5: the candidate's CI run is CircleCI's); the lead's keeper script, which this replaces once it lands.

## Constraints
- It is the only pusher to main — because a second pusher makes the tested candidate a tree main never was.
- Main moves only by fast-forward to the tested candidate, with a lease on the main it was built from — because a push that is not exactly what was tested is the failure this exists to stop.
- A push that starts a paid run is his to approve — so the queue's GitHub run uses the one he approved (L1, L2), and nothing more.

## Effort
high

## Ask me before
- Nothing beyond the repository's rules: the first `--land` that pushes main is run by the orchestrator, after the CircleCI project exists (L5).

## Specs
- S1. His ask, typed (transcript b878a67f, line 3974, 2026-10-14T21:18:29Z): "quiero es que podamos hacer en paralelo y como hacemos para no perder funcionalidades y tampoco calidad para que no se rompa nada, si quieres investiga muy bien en internet y dame una mejor solucion."
- S2. His answer, tapped (b878a67f, line 4162, 2026-10-14T21:26:16Z), to "¿Construimos el plan en este orden: tests exactos por commit y memoria de resultados (JH 8), cola de fusión local por tandas (JH 10), corridas de GitHub de a dos tests y lista de tests inestables?": "Sí, en ese orden (Recomendada)".
- S3. Step 3 of that plan, the orchestrator's words (C:\Users\Oficina\.js-harness\research\parallel-gate.md): "JH 10 - Local batching merge queue, the evolution of merge-ready (replaces the lead's keeper script): candidate = main plus the ready PRs in order; whole suite once locally under the lock, then once on Actions on a queue/* branch; green: push main (PRs show merged); red: bisect. It must be the only pusher to main. Ends the re-run chase (each code merge staling every open PR)."
- S4. Ready, for the queue: what `merge-ready` checks of the pull request itself (open, not a draft, mergeable, base main, a gentle-ai line), every code commit covered by a Codex review record, and a merge into the candidate with no conflict. Its own GitHub run is not needed: the candidate's run is the one that counts.
- S5. The candidate: origin/main, then each ready pull request merged in order of number with `--no-ff`; one that conflicts with the candidate so far is left out and named.
- S6. Green is the whole suite once locally under the gate lock and once on GitHub on the candidate, in that order: the local one is free and the GitHub one is not.
- S7. Green: main is pushed as the candidate, fast-forward only, leased on the main it was built from. The pull requests show merged by reachability. A main that moved meanwhile ends the run with nothing pushed.
- S8. Red: the batch is bisected locally, halves tested under the lock until the pull request that breaks it is named; it leaves the batch and the rest is tried again.
- S9. Only pusher: the pre-push hook refuses a push of main from anywhere but the queue.
- S10. `--dry-run` builds and prints the candidate and pushes nothing.

## Tasks
- [x] T1 (S4, S5, S10): the candidate, built and printed. Route: inline. RED: bin/merge-queue.test.mjs failed on the missing module, then on the two hook cases (L4); GREEN 6 of 6. Real run, 2026-10-14: "Candidate: main eb6abf7 with 2 pull requests merged in order: PR 137 (docs/gate-turn-guards-followups), PR 146 (fix/codegraph-home-files)."
- [x] T2 (S6, S7): `--land`: the local suite under the lock, the CircleCI run of a `queue/*` branch (L5), the push of main by fast-forward leased on the main it was built from. Route: inline. RED: the four `--land` tests of bin/merge-queue.test.mjs; GREEN 10 of 10. Not yet run for real: it needs the CircleCI project (ci/circleci).
- [x] T3 (S8): bisection on a red local suite: the shortest red prefix of the candidate's merges names the pull request; it leaves, the rest are merged again on the green prefix and landed. Route: inline. RED then GREEN: "a candidate red on this machine is bisected..." (suites seen: red, green, green); 11 of 11. A candidate green here and red on CircleCI is not bisected: it is reported, and main is not pushed.
- [x] T4 (S9): the pre-push hook refuses a push or delete of main unless `JS_HARNESS_MERGE_QUEUE=1`, which `--land` sets on its push of main. Route: inline. RED: two of the three new tests of bin/pre-push-hook.test.mjs; GREEN 10 of 10. High risk (a guard): independent verifier pending. Its limit, L6.
- [ ] T5: help, README, the keeper script retired. Route: inline.

## Log
- L1. 2026-10-14 16:26, the orchestrator's order to JH 10 (cross-session message): "Yours is step 3 ... Order: merge-ready first as planned, then the queue, then the conflict-hunk review. Specs in your document with his words from the file, test first." His words in S1 and S2 were read with `js-harness sessions --quote`.
- L2. 2026-10-14, measured by the orchestrator (parallel-gate.md): 46 gates in 109 min, median wait for a turn 30 min; GitHub run median 214 s, billed 4 min; about 227 Actions minutes this month, 205 of them on 2026-10-14.
- L3. 2026-10-14 16:28, open, for him through the orchestrator: gate.yml runs on `pull_request` only, and scripts/gate-workflow.test.mjs holds that no branch without a pull request runs. The candidate can get its GitHub run without touching the workflow by opening a draft pull request of its queue branch (its merge into main is the candidate itself, since main is its ancestor), or the workflow can gain a `push` trigger for `queue/**`, which is a workflow change on main. Recommended: the draft pull request, since it changes no workflow and keeps one kind of run.
- L9. 2026-10-14, a mistake of this session, found by the independent verifier of T4: T1 set `user.name` and `user.email` with `git config` inside the candidate's worktree, which has no configuration of its own, so the first real dry run (about 16:35) wrote them into the shared D:\js-harness\.git\config. Until they were unset (about 17:50; `git config --show-origin --get-all user.name` then shows only C:/Users/Oficina/.gitconfig, Sebastian Aristizabal), 24 commits of several sessions were authored "js-harness merge-queue" (`git log --all --since="2026-10-14 16:30" --format=%an | sort | uniq -c`), some of them on main (cf2898d, 1bb5641). The fix: no identity is written; the test "a run leaves the configuration of the repository as it found it" compares `git config --local --list` before and after. Rewriting the commits already authored is not this session's to decide.
- L8. 2026-10-14, a defect of the recheck (PR 128, odd/tasks/read-from-records.md, this session's): a branch forked at e61ae6a, the head of a review with findings that 8ccd689 rechecked, had its own review refused as "a second recheck", though its range is new code. `recheckState` refuses any range that starts at a head already rechecked; it should tell a range that continues the rechecked line from one that forks from it. Worked around here by rebasing on origin/main (the branch was never pushed); the fix belongs to read-from-records, T4 or a task of its own.
- L7. 2026-10-14, state for a resume: T1-T4 committed (bbef977, e8a7982, 559c1dd, 78a1e7d). Next, in order: the independent verifier of T4 (launched); one Codex review of the branch from its base (`js-harness codex-review --base origin/main --plan` first, against the allowance); T5 (README is current; the keeper script is the orchestrator's to retire); push and a pull request. A real `--land` needs the CircleCI project (draft PR 155, ci/circleci), which he sets up; then measure a run against GitHub's 214 s. Related, in another branch: feat/merge-review (the conflict-hunk review), its fix of Codex's 2 P2 in the gate, then its recheck and pull request.
- L6. 2026-10-14, the limit of S9: the hook sees only a push made from a clone. `gh pr merge`, which merges on GitHub's side and is how main moves today, never passes through it, and neither does the merge button. The queue is the only pusher of main when the lead's keeper script is retired (T5) and nobody merges by hand; GitHub's branch protection would hold it on the server, and that is a setting of the repository, his. The environment variable is a mark against mistakes, not a lock against a session that sets it on purpose.
- L5. 2026-10-14, L3 settled by his choice of CircleCI (tapped "Sí, ya", b878a67f line 4267, to "¿Sumamos CircleCI gratis como segundo sistema de pruebas para las corridas completas de la cola de fusión? Vos creás la cuenta y autorizás su app en GitHub; JH 10 lo conecta y mide."; and typed, line 4404: "ahh ok listo entonces ya cree la cuenta, ya puedes continua con eso cierto?"). CircleCI builds branches, so a pushed `queue/*` branch gets its full run with no pull request and no change to gate.yml; .circleci/config.yml (branch ci/circleci) runs only for `queue/*`. S6's GitHub run is that CircleCI run, read from the commit's check runs and statuses. CircleCI bills by the second, then the whole credit ("First we round up to the nearest second, and then up to the nearest credit", https://circleci.com/docs/reference/faq/). Pushing main is `--land`, a mode of its own: a run that changes main is never the default.
- L4. 2026-10-14, found by the first real dry run: every pull request read as "conflicts with the candidate so far", with no file named. The repository's pre-merge-commit hook runs the gate on every `git merge`; in the candidate it waited for a turn and then refused. The candidate's merges now run with `--no-verify`, since the queue runs the suite once on the whole candidate (S6), and a merge that fails with no conflicted file says what git said.

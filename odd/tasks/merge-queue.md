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
- [ ] T3 (S8): bisection. Route: inline.
- [ ] T4 (S9): the pre-push refusal. Route: inline. High risk (a guard): independent verifier.
- [ ] T5: help, README, the keeper script retired. Route: inline.

## Log
- L1. 2026-10-14 16:26, the orchestrator's order to JH 10 (cross-session message): "Yours is step 3 ... Order: merge-ready first as planned, then the queue, then the conflict-hunk review. Specs in your document with his words from the file, test first." His words in S1 and S2 were read with `js-harness sessions --quote`.
- L2. 2026-10-14, measured by the orchestrator (parallel-gate.md): 46 gates in 109 min, median wait for a turn 30 min; GitHub run median 214 s, billed 4 min; about 227 Actions minutes this month, 205 of them on 2026-10-14.
- L3. 2026-10-14 16:28, open, for him through the orchestrator: gate.yml runs on `pull_request` only, and scripts/gate-workflow.test.mjs holds that no branch without a pull request runs. The candidate can get its GitHub run without touching the workflow by opening a draft pull request of its queue branch (its merge into main is the candidate itself, since main is its ancestor), or the workflow can gain a `push` trigger for `queue/**`, which is a workflow change on main. Recommended: the draft pull request, since it changes no workflow and keeps one kind of run.
- L5. 2026-10-14, L3 settled by his choice of CircleCI (tapped "Sí, ya", b878a67f line 4267, to "¿Sumamos CircleCI gratis como segundo sistema de pruebas para las corridas completas de la cola de fusión? Vos creás la cuenta y autorizás su app en GitHub; JH 10 lo conecta y mide."; and typed, line 4404: "ahh ok listo entonces ya cree la cuenta, ya puedes continua con eso cierto?"). CircleCI builds branches, so a pushed `queue/*` branch gets its full run with no pull request and no change to gate.yml; .circleci/config.yml (branch ci/circleci) runs only for `queue/*`. S6's GitHub run is that CircleCI run, read from the commit's check runs and statuses. CircleCI bills by the second, then the whole credit ("First we round up to the nearest second, and then up to the nearest credit", https://circleci.com/docs/reference/faq/). Pushing main is `--land`, a mode of its own: a run that changes main is never the default.
- L4. 2026-10-14, found by the first real dry run: every pull request read as "conflicts with the candidate so far", with no file named. The repository's pre-merge-commit hook runs the gate on every `git merge`; in the candidate it waited for a turn and then refused. The candidate's merges now run with `--no-verify`, since the queue runs the suite once on the whole candidate (S6), and a merge that fails with no conflicted file says what git said.

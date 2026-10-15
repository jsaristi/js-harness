The merge queue's CircleCI run of each candidate is the only CI run: no GitHub Actions run per pull request.
Branch: ci/drop-github-gate. Delivery: single-pr, as a draft (a CI change on main is his decision). Tests: `node --test`.

## Goal
No GitHub Actions workflow runs for a pull request, and the CircleCI run of each merge-queue candidate runs the gate
exactly as the GitHub run did, so dropping the GitHub run loses no check.

## Why
Code reaches main only through `merge-queue --land` (PR 167), which tests the candidate, main as it will be, on
CircleCI. A pull request's own GitHub run tests an older merge of it and spends Actions minutes of an account with
2,000 a month and no card; merge-queue.md S4 already says that run is not needed. Before it goes, the CircleCI run
must not miss anything the GitHub run did.

## Done when
- `node --test scripts/circleci-config.test.mjs scripts/github-workflows.test.mjs` exits 0
- `npm run check` exits 0
- `git ls-files .github/workflows` prints nothing

## In scope / Out of scope
- In: .github/workflows/gate.yml (removed), scripts/gate-workflow.test.mjs (replaced by scripts/github-workflows.test.mjs), .circleci/config.yml and scripts/circleci-config.test.mjs, docs/FAILURES.md (one sighting), README.md where it names the GitHub run of the gate, this document.
- Out: `js-harness merge-ready` and its README section, which decide on a pull request's GitHub run: retiring a command is a contract change of its own (follow-up for the lead). bin/lib/manifest.mjs, whose rule on CI is shipped to installed projects, not about this repository.

## Constraints
- The CircleCI run stays bounded as scripts/circleci-config.test.mjs holds it (one job, exact image, medium, no parallelism, no secret, `queue/*` only) — because its free plan has 30,000 credits a month and no card.
- No workflow may come back unnoticed — because a workflow on a pull request spends Actions minutes nobody approved.

## Ask me before
- Marking the pull request ready: a CI change on main is Sebastián's, asked by the lead when he is back.

## Specs
- S1. The lead's order (cross-session message from "JH ORQ · js-harness (350k)", 2026-10-15): "Feature A: drop the per-pull-request GitHub Actions run now that the merge queue's CircleCI run of each candidate is the proof (odd/tasks/merge-queue.md S4: "Its own GitHub run is not needed: the candidate's run is the one that counts")." And: "First, measure and explain one gap: PR 185's own GitHub run (https://github.com/jsaristi/js-harness/actions/runs/38722955417) failed on "FAIL budget 1501 estimated tokens (budget 1500)" and a failing test "a missing login stops the trial before the agent starts, with an error that names `codex login`", yet the queue's candidate d1ac020 with 185 was green on this machine and on CircleCI. Find out whether CircleCI runs the same rows as gate.yml; if CircleCI misses a check, A must close that gap first."
- S2. The gap closed first (L2): the CircleCI gate step runs the test files two at a time, `JS_HARNESS_TEST_CONCURRENCY: 2`, as gate.yml did, instead of node's default of one fewer than the processors the container reports. Assumption, unmeasured: the medium class is 2 vCPUs, the runner's processor line is in CircleCI's log, which needs a token this session does not use.
- S3. No GitHub workflow: .github/workflows/gate.yml is removed, and a test of the gate fails while the repository holds any file under .github/workflows.
- S4. What names the GitHub run of the gate says it is gone: the CircleCI config's header, README where it describes the gate on GitHub.

## Tasks
- [x] T1 (S2, kind: build): CircleCI runs the test files two at a time. Route: inline. RED: the new test of scripts/circleci-config.test.mjs, actual `[ 'name: The gate', 'command: node bin/check.mjs', 'no_output_timeout: 15m' ]`; GREEN 4 of 4.
- [x] T2 (S3, kind: build): gate.yml removed, its test replaced by one that holds that no workflow exists. Route: inline. RED: scripts/github-workflows.test.mjs, actual `[ 'gate.yml' ]`; GREEN 1 of 1 after `git rm` of gate.yml and scripts/gate-workflow.test.mjs.
- [x] T3 (S4, kind: docs): the CircleCI header and README; the second sighting of eval-missing-login-workroot-kept in docs/FAILURES.md. Route: inline. `js-harness failures check` and `js-harness contract check` on this document pass.

## Log
- L1. 2026-10-15 06:50 (local), the lead's order to JH 21, quoted in S1; the old lead's retirement notice came at 06:06.
- L2. 2026-10-15 06:54, the gap measured (S1). Run 38722955417, PR 185 head 8d1d54f, event pull_request, 10:49:15Z. Its real budget row reads "PASS  budget  1478 estimated tokens (budget 1500)" (log line 36); "FAIL  budget  1501 estimated tokens (budget 1500)" (line 235) is the output of a passing test of check, which builds an AGENTS.md over budget on purpose ("main exits 1 when a row fails (budget over limit, tests skipped)", line 259). The one real failure is the test of evals/codex-configs.test.mjs, "the home and the workspace are removed all the same", `actual: [ 'eval-k9fHPH' ]` where `[]` was expected: the known flaky failure eval-missing-login-workroot-kept (docs/FAILURES.md, first seen on run 38705933668; docs/FLAKY.md, owner JH 10, expires 2026-10-22), a cleanup not ended when the test reads the work root under load. Both systems run the same rows: the one command `node bin/check.mjs` on Linux with the whole history and origin/main present (gate.yml: checkout fetch-depth 0; config.yml: checkout, then a fetch of main), and `git grep -nE "GITHUB_ACTIONS|CIRCLECI|process\.env\.CI\b" origin/main -- bin scripts evals` finds nothing, so no row depends on which system runs it. The one difference is how the suite is run: gate.yml sets `JS_HARNESS_TEST_CONCURRENCY: 2`, which check passes to node as `--test-concurrency=2` (the failing run: "npm run test -- --test-concurrency=2 exited 1"); config.yml sets nothing, so node runs one fewer test files at a time than the processors the container reports. Candidate d1ac020 (main now, with 185, 186, 197 and 198) has "ci/circleci: check" success, job 3. Missed check: none; the concurrency is pinned anyway (S2), so what the queue tests is what GitHub tested, under the same load.
- L3. 2026-10-15 07:00, two notes from the lead. One confirms L2 from JH 10's record (merge-queue.md L17): the same "FAIL budget 1501" line showed in JH 10's first red land while AGENTS.md was 1478, the output of a test that builds its own AGENTS.md. The other hands JH 21 the two docs/FLAKY.md entries JH 10 owned (both expire 2026-10-22): their owner is now JH 21. The suite entry can go once the sweep fix holds a few gates; codex-configs needs its own fix (a follow-up, not this feature). Commit 65ffb9a holds T1 to T3, gate green ("PASS  tests  npm run test passed in WSL2").
- L4. 2026-10-15, gentle-ai review of d1ac020..2143e9b (lineage review-61f3cd20ae74d5fe, lenses risk and reliability): approved and acknowledged (authority burned). Two advisories, both taken: R3-workflows-guard-scope (WARNING), the done-when said `git ls-files .github` while the test holds .github/workflows, the only folder whose files start a run, so the done-when now names that folder; R3-concurrency-assumption-unproved (SUGGESTION), the config's comment no longer states the container's processor count as fact. Next: Codex review of the branch (plan: about 150,000 input tokens, within the allowance), push, draft pull request.
- L5. 2026-10-15, 65a2ad7 holds the advisories of L4, gate green. Codex reviewed d1ac020..65a2ad7: "the patch is correct (confidence 0.96)", no findings, 74,515 input tokens (49,280 cached), recorded. Next: push and a draft pull request; it stays a draft until Sebastián decides the CI change on main (the lead asks him). Follow-ups for the lead: retire or rewrite `js-harness merge-ready`, which decides on a pull request's GitHub run that no longer exists; the fix of eval-missing-login-workroot-kept, owned by JH 21 now.
- L6. 2026-10-15, the second sighting of eval-missing-login-workroot-kept left this branch for fix/fixture-commit-no-maintenance, the fix of that failure, which adds its control to the same entry: two branches editing adjacent lines of docs/FAILURES.md would conflict in the merge queue.
